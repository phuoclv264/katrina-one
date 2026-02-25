'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/loading/LoadingPage';
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
    Calendar,
    Users,
} from 'lucide-react';
import {
    getISOWeek,
    getISOWeekYear,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    eachDayOfInterval,
    isSameDay,
    getDay,
    isSameWeek,
    isAfter,
    isWithinInterval,
    parseISO,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Schedule, AssignedShift, Availability, ManagedUser, ShiftTemplate, Notification, UserRole, AssignedUser, SimpleUser, ShiftBusyEvidence, SpecialPeriod } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';
import ShiftAssignmentDialog from './shift-assignment-popover'; // Renaming this import for clarity, but it's the right file
import ShiftTemplatesDialog from './shift-templates-dialog';
import TotalHoursDialog from './total-hours-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogIcon } from '@/components/ui/alert-dialog';
import HistoryAndReportsDialog from './history-reports-dialog';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import isEqual from 'lodash.isequal';
import { Badge } from '@/components/ui/badge';
import PassRequestsDialog from '../../schedule/_components/pass-requests-dialog';
import { isUserAvailable, hasTimeConflict, calculateShiftExpectedSalary, calculateTotalExpectedSalary } from '@/lib/schedule-utils';
import { getRelevantUnderstaffedShifts } from './understaffed-evidence-utils';
import { useSearchParams } from 'next/navigation';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';
import { useRouter } from 'nextjs-toploader/app';
import { Label } from '@/components/ui/label';
import AutoScheduleDialog from './auto-schedule-dialog';
import { UnderstaffedEvidenceDialog } from './understaffed-evidence-dialog';
import { useAppNavigation } from '@/contexts/app-navigation-context';


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
                        for (let j = otherParts.length - 2; j >= i; j--) {
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

// Currency formatter for expected salary display
const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });


export default function ScheduleView() {
    const { user } = useAuth();
    const isMobile = useIsMobile();
    const searchParams = useSearchParams();
    const router = useRouter();
    const routerRef = useRef(router);
    const nav = useAppNavigation();


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
    const [incomingSchedule, setIncomingSchedule] = useState<Schedule | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [availability, setAvailability] = useState<Availability[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [specialPeriods, setSpecialPeriods] = useState<SpecialPeriod[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [busyEvidences, setBusyEvidences] = useState<ShiftBusyEvidence[]>([]);
    const [isUnderstaffedDialogOpen, setIsUnderstaffedDialogOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);


    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);
    const [activeNotification, setActiveNotification] = useState<Notification | null>(null);


    const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isPassRequestsDialogOpen, setIsPassRequestsDialogOpen] = useState(false);

    const [isTotalHoursDialogOpen, setIsTotalHoursDialogOpen] = useState(false);

    const [isHandlingConflict, setIsHandlingConflict] = useState(false);
    const [conflictDialog, setConflictDialog] = useState<{ isOpen: boolean; oldRequest: Notification | null; newRequestFn: () => void }>({ isOpen: false, oldRequest: null, newRequestFn: () => { } });

    const [structuredConstraints, setStructuredConstraints] = useState<any[]>([]);
    const [isAutoDialogOpen, setIsAutoDialogOpen] = useState(false);

    useEffect(() => {
        const unsub = dataStore.subscribeToStructuredConstraints((list) => setStructuredConstraints(list || []));
        return () => unsub();
    }, []);

    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);

    const daysOfWeek = useMemo(() => eachDayOfInterval(weekInterval), [weekInterval]);

    const [openMobileDays, setOpenMobileDays] = useState<string[]>(
        () => daysOfWeek.map(day => format(day, 'yyyy-MM-dd'))
    );


    const weekId = useMemo(() => `${getISOWeekYear(currentDate)}-W${getISOWeek(currentDate)}`, [currentDate]);

    const canManage = useMemo(() => user?.role === 'Chủ nhà hàng', [user]);

    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);
    const [showAdminActionConfirm, setShowAdminActionConfirm] = useState(false);

    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    useEffect(() => {
        if (!user || !canManage) return;

        setIsLoading(true);
        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            setIncomingSchedule(newSchedule);
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

        const unsubNotifications = dataStore.subscribeToAllPassRequestNotifications(setNotifications);
        const unsubBusyEvidences = dataStore.subscribeToShiftBusyEvidencesForWeek(weekId, setBusyEvidences);
        const unsubSpecialPeriods = dataStore.subscribeToSpecialPeriods(setSpecialPeriods);

        return () => {
            unsubSchedule();
            unsubAvailability();
            unsubUsers();
            unsubTemplates();
            unsubNotifications();
            unsubBusyEvidences();
            unsubSpecialPeriods();
        };

    }, [user, weekId, canManage]);

    useEffect(() => {
        const openPassRequest = getQueryParamWithMobileHashFallback({
            param: 'openPassRequest',
            searchParams,
            hash: typeof window !== 'undefined' ? window.location.hash : '',
        });

        if (openPassRequest === 'true') {
            setIsPassRequestsDialogOpen(true);
            // clear any parameters encoded in the hash/search without triggering
            // navigation or disrupting the dialog state
            nav.replace('/shift-scheduling', { clearParam: 'openPassRequest' });
        }

        // Handle opening specific shift from notification
        const urlWeekId = getQueryParamWithMobileHashFallback({
            param: 'weekId',
            searchParams,
            hash: typeof window !== 'undefined' ? window.location.hash : '',
        });
        const openShiftId = getQueryParamWithMobileHashFallback({
            param: 'openShift',
            searchParams,
            hash: typeof window !== 'undefined' ? window.location.hash : '',
        });

        // 1. Navigate to the correct week if needed
        if (urlWeekId && urlWeekId !== weekId && /^\d{4}-W\d{1,2}$/.test(urlWeekId)) {
            const parts = urlWeekId.split('-W');
            const year = parseInt(parts[0]);
            const week = parseInt(parts[1]);
            if (!isNaN(year) && !isNaN(week)) {
                const jan4 = new Date(year, 0, 4);
                const weekStart = addDays(startOfWeek(jan4, { weekStartsOn: 1 }), (week - 1) * 7);
                setCurrentDate(weekStart);
            }
        }

        // 2. Open the shift assignment dialog
        if (openShiftId && localSchedule && localSchedule.weekId === (urlWeekId || weekId)) {
            const shift = localSchedule.shifts.find(s => s.id === openShiftId);
            if (shift) {
                setActiveShift(shift);
                setIsAssignmentDialogOpen(true);

                nav.replace('/shift-scheduling', { scroll: false });
            }
        }
    }, [searchParams, localSchedule, weekId, isMobile]);

    // Normalize assigned users once both schedule data and user roles are available.
    useEffect(() => {
        if (!incomingSchedule) {
            setServerSchedule(null);
            setLocalSchedule(null);
            setHasUnsavedChanges(false);
            return;
        }

        const normalizedSchedule: Schedule = {
            ...incomingSchedule,
            shifts: incomingSchedule.shifts.map((shift: AssignedShift) => {
                const normalizedAssignedUsers: AssignedUser[] = shift.assignedUsers
                    .filter((au: AssignedUser) => allUsers.some((u) => u.uid === au.userId))
                    .map((au: AssignedUser) => {
                        const fallbackRole = allUsers.find((u) => u.uid === au.userId)?.role;
                        const resolvedRole: UserRole = au.assignedRole ?? fallbackRole ?? 'Phục vụ';
                        return { ...au, assignedRole: resolvedRole };
                    });
                return { ...shift, assignedUsers: normalizedAssignedUsers };
            }),
        };

        setServerSchedule(normalizedSchedule);
        setLocalSchedule(normalizedSchedule);
        setHasUnsavedChanges(false);
    }, [incomingSchedule, allUsers]);

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

        const daysInWeek = eachDayOfInterval({ start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) })

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
                        requiredRoles: template.requiredRoles ?? [],
                        assignedUsers: existingShift ? existingShift.assignedUsers : [],
                    });
                }
            });
        });

        const sortedNewShifts = [...newShiftsFromTemplates].sort((a, b) => a.id.localeCompare(b.id));
        const sortedLocalShifts = [...baseSchedule.shifts].sort((a, b) => a.id.localeCompare(b.id));

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

    const handleUpdateShiftAssignment = useCallback(async (shiftId: string, newAssignedUsers: { userId: string, userName: string, assignedRole: UserRole }[]) => {
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
            requiredRoles: template.requiredRoles ?? [],
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
            await dataStore.updatePassRequestNotificationStatus(notificationId, 'cancelled', user);
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
            const acceptingUser: SimpleUser = { userId: user.uid, userName: user.displayName || 'N/A' };

            await dataStore.acceptPassShift(notification.id, notification.payload, acceptingUser, allUsers, localSchedule);

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
        } catch (error: any) {
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

    // --- Salary calculations (expected) ---
    const shiftSalaryMap = useMemo(() => {
        const schedule = localSchedule ?? serverSchedule;
        const map = new Map<string, number>();
        (schedule?.shifts || []).forEach(s => {
            map.set(s.id, calculateShiftExpectedSalary(s, allUsers, specialPeriods));
        });
        return map;
    }, [localSchedule, serverSchedule, allUsers, specialPeriods]);

    const dailySalaryMap = useMemo(() => {
        const schedule = localSchedule ?? serverSchedule;
        const map = new Map<string, number>();
        daysOfWeek.forEach(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const shiftsOnDay = (schedule?.shifts || []).filter(s => s.date === dateKey);
            map.set(dateKey, calculateTotalExpectedSalary(shiftsOnDay, allUsers, specialPeriods));
        });
        return map;
    }, [localSchedule, serverSchedule, daysOfWeek, allUsers, specialPeriods]);

    const weeklyExpectedSalary = useMemo(() => {
        let total = 0;
        for (const v of dailySalaryMap.values()) total += v;
        return total;
    }, [dailySalaryMap]);

    const userAbbreviations = useMemo(() => generateSmartAbbreviations(allUsers), [allUsers]);

    if (isLoading) {
        return <LoadingPage />;
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

        const displayedRole = assignedUser.assignedRole ?? userDetails.role;
        const userAvailability = availabilityByDay[dateKey];
        const isBusy = userAvailability ? !isUserAvailable(assignedUser.userId, shiftObject.timeSlot, userAvailability) : false;
        const shiftCount = dailyShiftCounts.get(dateKey)?.get(assignedUser.userId) || 1;
        const hasMultipleShifts = shiftCount >= 2;
        const nameToShow = userAbbreviations.get(assignedUser.userId) || assignedUser.userName;

        const badgeContent = (
            <Badge className={cn("h-auto py-0.5 text-xs flex items-center", getRoleColor(displayedRole), isBusy && 'ring-2 ring-destructive/50')}>
                {isBusy && <AlertTriangle className="h-3 w-3 mr-1 text-destructive-foreground" />}
                {hasMultipleShifts && (
                    <span className={cn("font-bold mr-1", shiftCount > 2 ? 'text-red-500' : 'text-yellow-500')}>{shiftCount}</span>
                )}
                {nameToShow}
                {displayedRole && (
                    <span className="text-xs mr-1 pl-1 font-medium text-muted-foreground">{displayedRole === 'Phục vụ' ? 'PV' : (displayedRole === 'Pha chế' ? 'PC' : 'QL')}</span>
                )}
            </Badge>
        );

        const tooltipContent = [
            isBusy && "Nhân viên này không đăng ký rảnh.",
            hasMultipleShifts && `Nhân viên này được xếp ${shiftCount} ca hôm nay.`,
            assignedUser.assignedRole && `Vai trò được phân công: ${assignedUser.assignedRole}`
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

    const handleBackToToday = () => {
        const today = new Date();
        const todayKey = format(today, 'yyyy-MM-dd');

        // 1. Set to current week if needed
        if (!isSameWeek(currentDate, today, { weekStartsOn: 1 })) {
            setCurrentDate(today);
        }

        // 2. Expand today in accordion
        if (!openMobileDays.includes(todayKey)) {
            setOpenMobileDays(prev => [...prev, todayKey]);
        }

        // 3. Scroll to today
        // Use a timeout to allow render/expansion
        setTimeout(() => {
            const el = document.getElementById('today-mobile-item');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    };

    return (
        <TooltipProvider>
            <div className="flex flex-col xl:flex-row gap-8">
                {/* Main Schedule View */}
                <div className="flex-1">
                    {/* Integrated Control Hub Section - Compact Design */}
                    <Card className="mb-3 overflow-hidden shadow-lg border-none ring-1 ring-slate-200/50 dark:ring-slate-800/50 bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900/50">
                        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-slate-100 dark:divide-slate-800/50 lg:divide-y-0">
                            {/* Personnel Status Section */}
                            <div className="p-3 transition-all hover:bg-amber-50/20 dark:hover:bg-amber-900/5 flex flex-col justify-between border-t-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="size-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 ring-1 ring-amber-200 dark:ring-amber-500/20">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Nhân sự</h4>
                                        <p className="text-xs text-muted-foreground leading-tight">
                                            <span className="font-bold text-amber-600 dark:text-amber-400">{getRelevantUnderstaffedShifts(localSchedule ?? serverSchedule, allUsers, { currentUser: null, roleAware: false }).length} ca</span> thiếu
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setIsUnderstaffedDialogOpen(true)}
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-6 border-amber-200 dark:border-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold rounded-lg text-[10px]"
                                >
                                    Xem thiếu
                                </Button>
                            </div>

                            {/* Pass Requests Section */}
                            <div
                                className="p-3 transition-all cursor-pointer hover:bg-blue-50/20 dark:hover:bg-blue-900/5 group flex flex-col justify-between"
                                onClick={() => setIsPassRequestsDialogOpen(true)}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="size-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 ring-1 ring-blue-200 dark:ring-blue-500/20 relative">
                                        <MailQuestion className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        {pendingRequestCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border border-white dark:border-slate-950 flex items-center justify-center">
                                                    <span className="text-[7px] font-bold text-white">{pendingRequestCount}</span>
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Pass ca</h4>
                                        <p className="text-xs text-muted-foreground leading-tight">
                                            {pendingRequestCount > 0 ? `${pendingRequestCount} chờ duyệt` : "Hoàn thành"}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-6 border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold rounded-lg text-[10px]"
                                >
                                    Chi tiết
                                </Button>
                            </div>

                            {/* Workload Section (Total Hours) */}
                            <div
                                className="p-3 transition-all cursor-pointer hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 group flex flex-col justify-between lg:border-t-0"
                                onClick={() => setIsTotalHoursDialogOpen(true)}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="size-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 ring-1 ring-indigo-200 dark:ring-indigo-500/20">
                                        <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Thống kê</h4>
                                        <p className="text-xs text-muted-foreground leading-tight">
                                            <span>Tổng giờ làm</span>
                                            <br />
                                            <span className="font-bold">Lương dự kiến: {currencyFormatter.format(weeklyExpectedSalary)}</span>
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-6 border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold rounded-lg text-[10px]"
                                >
                                    Xem lịch rảnh
                                </Button>
                            </div>

                            {/* Schedule Control Section */}
                            <div className="p-3 bg-slate-50/50 dark:bg-slate-900/10 transition-all flex flex-col justify-between lg:border-t-0">
                                {user?.role === 'Chủ nhà hàng' && localSchedule?.status === 'published' && !hasUnsavedChanges ? (
                                    <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm} dialogTag="alert-dialog" parentDialogTag="root" variant="warning">
                                        <AlertDialogTrigger asChild>
                                            <div className="contents cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="size-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 ring-1 ring-orange-200 dark:ring-orange-500/20">
                                                        <FileSignature className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Phát hành</h4>
                                                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tight">Đã công bố</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full h-6 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold border border-orange-200/50 dark:border-orange-500/20 rounded-lg text-[10px]"
                                                >
                                                    Thu hồi
                                                </Button>
                                            </div>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogIcon icon={History} />
                                                <div className="space-y-2 text-center sm:text-left">
                                                    <AlertDialogTitle>Thu hồi lịch đã công bố?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Hành động này sẽ thu hồi lịch, ẩn nó khỏi trang của nhân viên và chuyển về trạng thái 'Bản nháp' để bạn có thể tiếp tục chỉnh sửa.
                                                    </AlertDialogDescription>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleUpdateStatus('draft')}>Xác nhận thu hồi</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                ) : (
                                    <div className="flex h-full items-center justify-center gap-2 opacity-30">
                                        <Settings className="h-4 w-4 text-muted-foreground" />
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bị khóa</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    <UnderstaffedEvidenceDialog
                        open={isUnderstaffedDialogOpen}
                        onOpenChange={setIsUnderstaffedDialogOpen}
                        schedule={localSchedule ?? serverSchedule}
                        allUsers={allUsers}
                        evidences={busyEvidences}
                        parentDialogTag='root'
                    />
                    <Card className="border-none shadow-sm pb-6">
                        <CardHeader className="sticky top-[3.5rem] z-30 flex items-center justify-center sm:justify-end bg-background/95 backdrop-blur-md border-b mb-0 rounded-t-2xl px-4 py-1.5 transition-all duration-300">
                            <div className="flex items-center gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 w-full sm:w-auto shadow-inner overflow-hidden">
                                <div className="px-2.5 py-1 bg-white/50 dark:bg-zinc-800/50 rounded-lg flex items-center gap-2 border border-zinc-200/50 dark:border-zinc-700/50 mr-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 hidden xs:inline">Trạng thái:</span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            "uppercase text-[9px] font-black px-1.5 py-0 rounded-md tracking-wider border-none ring-1 ring-inset shadow-sm",
                                            localSchedule?.status === 'published'
                                                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
                                                : localSchedule?.status === 'proposed'
                                                    ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20"
                                                    : "bg-zinc-100 text-zinc-700 ring-zinc-600/10 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"
                                        )}
                                    >
                                        {localSchedule?.status === 'published' ? 'Đã công bố' : (localSchedule?.status === 'proposed' ? 'Đã đề xuất' : (localSchedule?.status === 'draft' ? 'Bản nháp' : 'Chưa có lịch'))}
                                    </Badge>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDateChange('prev')}
                                    className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-800 hover:shadow-md transition-all active:scale-95"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-2 px-1">
                                    <div className="flex flex-col items-center justify-center min-w-[90px] px-2">
                                        <span className="text-primary font-black text-[10px] whitespace-nowrap leading-none tracking-tight">
                                            {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}
                                        </span>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            onClick={() => setCurrentDate(new Date())}
                                            className={cn(
                                                "h-auto p-0 font-black text-[9px] uppercase tracking-[0.1em] hover:no-underline opacity-60 hover:opacity-100 transition-all",
                                                isCurrentWeek && "text-primary opacity-100"
                                            )}
                                        >
                                            Tuần này
                                        </Button>
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDateChange('next')}
                                    className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-zinc-800 hover:shadow-md transition-all active:scale-95"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 p-4 border rounded-md bg-muted/30">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                    <div className="w-full sm:w-auto">
                                        <Label className="font-semibold block">Xếp lịch tự động</Label>
                                        <p className="text-xs text-muted-foreground mt-1">Dựa vào đăng ký rảnh, vai trò, định mức và ràng buộc trong ứng dụng.</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => setIsAutoDialogOpen(true)} disabled={!canEditSchedule} aria-label="Xếp lịch tự động" className="w-full sm:w-auto">
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span className="whitespace-nowrap">Xếp lịch tự động</span>
                                    </Button>
                                </div>
                            </div>
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
                                            const isToday = isSameDay(day, new Date());
                                            const isPast = !isToday && isAfter(new Date(), day);
                                            return (
                                                <TableRow key={dateKey} className={cn("border-t", isToday && "bg-yellow-50 dark:bg-yellow-900/30", isPast && "opacity-70")}>
                                                    <TableCell className="font-semibold align-top text-center">
                                                        <p className={cn(isPast && 'text-muted-foreground', isToday && 'font-semibold')}>{format(day, 'eee, dd/MM', { locale: vi })}{isToday && <Badge className="ml-2 text-xs">Hôm nay</Badge>}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">Tổng ngày: <span className="font-semibold">{currencyFormatter.format(dailySalaryMap.get(dateKey) || 0)}</span></p>
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
                                                        const hasApplicants = (shiftObject.applicants?.length || 0) > 0;

                                                        const sortedAssignedUsers = [...shiftObject.assignedUsers].sort((a, b) => {
                                                            const userA = allUsers.find(u => u.uid === a.userId);
                                                            const userB = allUsers.find(u => u.uid === b.userId);
                                                            if (!userA || !userB) return 0;
                                                            const roleA = a.assignedRole ?? userA.role;
                                                            const roleB = b.assignedRole ?? userB.role;
                                                            return (roleOrder[roleA] || 99) - (roleOrder[roleB] || 99);
                                                        });

                                                        return (
                                                            <TableCell key={template.id} className={cn("p-1 align-top h-28 text-center border-l", isUnderstaffed && "bg-destructive/10", isPast && "opacity-60", isToday && "ring-1 ring-yellow-200")}>
                                                                <Button
                                                                    variant="ghost"
                                                                    className="h-full w-full flex flex-col items-center justify-center p-1 group relative"
                                                                    onClick={() => handleOpenAssignmentDialog(shiftObject)}
                                                                    disabled={!canEditSchedule}
                                                                >
                                                                    {isUnderstaffed && <AlertTriangle className="w-4 h-4 text-destructive absolute top-1.5 right-1.5" />}
                                                                    {hasApplicants && (
                                                                        <div className="absolute top-1.5 left-1.5 flex items-center justify-center bg-emerald-500 text-white text-[9px] font-bold rounded-full w-4 h-4 shadow-sm z-10" title="Có ứng viên">
                                                                            {shiftObject.applicants?.length}
                                                                        </div>
                                                                    )}
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

                                                                    {/* Shift expected salary */}
                                                                    <div className="mt-1">
                                                                        <p className="text-[11px] text-muted-foreground font-semibold">{currencyFormatter.format(shiftSalaryMap.get(shiftObject.id) || 0)}</p>
                                                                    </div>
                                                                </Button>
                                                            </TableCell>
                                                        )
                                                    })}
                                                </TableRow>
                                            )
                                        })}
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

                                        const isToday = isSameDay(day, new Date());
                                        const isPast = !isToday && isAfter(new Date(), day);
                                        return (
                                            <AccordionItem value={dateKey} key={dateKey} className={cn("border-b group", isToday && "bg-yellow-50 dark:bg-yellow-900/30", isPast && "opacity-70")}>
                                                <div className="p-4 bg-muted/30 rounded-t-md" id={isToday ? "today-mobile-item" : undefined}>
                                                    <AccordionTrigger className="font-semibold text-base hover:no-underline p-0">
                                                        <span className="text-lg">{format(day, 'eeee, dd/MM', { locale: vi })}{isToday && <Badge className="ml-2 text-xs">Hôm nay</Badge>}</span>
                                                    </AccordionTrigger>
                                                    <p className="text-sm text-muted-foreground mt-2">Tổng ngày: <span className="font-semibold">{currencyFormatter.format(dailySalaryMap.get(dateKey) || 0)}</span></p>
                                                    <div className="w-full space-y-2 mt-2 group-data-[state=open]:hidden">
                                                        {shiftsForDay.map(shiftObject => {
                                                            if (!shiftObject || shiftObject.assignedUsers.length === 0) return null;
                                                            const sortedAssignedUsers = [...shiftObject.assignedUsers].sort((a, b) => {
                                                                const userA = allUsers.find(u => u.uid === a.userId);
                                                                const userB = allUsers.find(u => u.uid === b.userId);
                                                                if (!userA || !userB) return 0;
                                                                const roleA = a.assignedRole ?? userA.role;
                                                                const roleB = b.assignedRole ?? userB.role;
                                                                return (roleOrder[roleA] || 99) - (roleOrder[roleB] || 99);
                                                            });
                                                            return (
                                                                <div key={shiftObject.id} className="flex items-start gap-2 flex-wrap text-sm font-normal">
                                                                    <span className="font-semibold">{shiftObject.role && shiftObject.role !== 'Bất kỳ' ? `${shiftObject.label} (${shiftObject.role})` : shiftObject.label}:</span>
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
                                                                const roleA = a.assignedRole ?? userA.role;
                                                                const roleB = b.assignedRole ?? userB.role;
                                                                return (roleOrder[roleA] || 99) - (roleOrder[roleB] || 99);
                                                            });

                                                            return (
                                                                <div key={template.id} className={cn("p-3 border rounded-md bg-card", isUnderstaffed && "border-destructive bg-destructive/10", isPast && "opacity-60", isToday && "ring-1 ring-yellow-200")}>
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

                                                                    <div className="mt-2">
                                                                        <p className="text-sm font-semibold text-muted-foreground">Lương dự kiến: {currencyFormatter.format(shiftSalaryMap.get(shiftObject.id) || 0)}</p>
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
                                        <Settings className="mr-2 h-4 w-4" /> Mẫu ca
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsHistoryDialogOpen(true)} className="flex-1 sm:flex-none">
                                    <History className="mr-2 h-4 w-4" /> Lịch sử
                                </Button>
                            </div>
                            <div className="flex-1" />
                            <div className="flex items-center justify-end gap-4 flex-wrap">
                                {user?.role === 'Chủ nhà hàng' && (!localSchedule || !localSchedule.status || localSchedule.status === 'proposed') && !hasUnsavedChanges && (
                                    <AlertDialog open={showAdminActionConfirm} onOpenChange={setShowAdminActionConfirm} dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" disabled={isSubmitting}>
                                                <FileX2 className="mr-2 h-4 w-4" />
                                                {localSchedule?.status === 'proposed' ? 'Trả về bản nháp' : 'Tạo bản nháp'}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogIcon icon={FileX2} />
                                                <div className="space-y-2 text-center sm:text-left">
                                                    <AlertDialogTitle>
                                                        {localSchedule?.status === 'proposed' ? 'Từ chối lịch đề xuất?' : 'Tạo lịch nháp mới?'}
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {localSchedule?.status === 'proposed'
                                                            ? "Hành động này sẽ chuyển lịch trở lại trạng thái 'Bản nháp', cho phép Quản lý tiếp tục chỉnh sửa."
                                                            : "Tuần này chưa có lịch. Hành động này sẽ tạo một lịch nháp mới dựa trên các mẫu ca hiện có."
                                                        }
                                                    </AlertDialogDescription>
                                                </div>
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
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            <TotalHoursDialog
                open={isTotalHoursDialogOpen}
                onOpenChange={setIsTotalHoursDialogOpen}
                schedule={localSchedule}
                availability={availability}
                allUsers={allUsers}
                currentUserRole={user?.role || null}
                onUpdateSchedule={handleLocalScheduleUpdate}
                daysOfWeek={daysOfWeek}
                dialogTag="total-hours"
                parentDialogTag="root"
            />

            {isFabVisible && (
                <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
                    <div className="relative">
                        {isPublishAction ? (
                            <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm} dialogTag="alert-dialog" parentDialogTag="root" variant="primary">
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
                                    <AlertDialogHeader>
                                        <AlertDialogIcon icon={CheckCircle} />
                                        <div className="space-y-2 text-center sm:text-left">
                                            <AlertDialogTitle>Công bố lịch làm việc?</AlertDialogTitle>
                                            <AlertDialogDescription>Hành động này sẽ công bố lịch cho tất cả nhân viên. Nếu có thay đổi chưa lưu, chúng cũng sẽ được lưu lại.</AlertDialogDescription>
                                        </div>
                                    </AlertDialogHeader>
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

            {/* Back to Today FAB (Mobile Only) */}
            <div className="fixed right-4 z-[20] transition-[bottom] duration-300 bottom-5 [.bottom-nav-visible_&]:bottom-20 md:hidden">
                <Button
                    size="icon"
                    className="w-14 h-14 rounded-full font-black shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center relative transition-all active:scale-95 p-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    onClick={handleBackToToday}
                    aria-label="Về hôm nay"
                >
                    <Calendar className="h-6 w-6" />
                </Button>
            </div>


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
                    weekInterval={weekInterval}
                    weekShifts={localSchedule?.shifts ?? []}
                    passRequestingUser={activeNotification?.payload.requestingUser}
                    parentDialogTag="root"
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
                parentDialogTag="root"
                onRejectApproval={handleRejectApproval}
                processingNotificationId={processingNotificationId}
                schedule={localSchedule}
            />

            {user?.role === 'Chủ nhà hàng' && (
                <>
                    <ShiftTemplatesDialog
                        isOpen={isTemplatesDialogOpen}
                        onClose={() => setIsTemplatesDialogOpen(false)}
                        parentDialogTag='root'
                    />
                    <HistoryAndReportsDialog
                        isOpen={isHistoryDialogOpen}
                        onClose={() => setIsHistoryDialogOpen(false)}
                        allUsers={allUsers}
                        parentDialogTag='root'
                    />
                </>
            )}

            <AutoScheduleDialog
                isOpen={isAutoDialogOpen}
                onClose={() => setIsAutoDialogOpen(false)}
                schedule={localSchedule ?? { weekId, status: 'draft', shifts: [] }}
                allUsers={allUsers}
                availability={availability}
                constraints={structuredConstraints as any}
                shiftTemplates={shiftTemplates}
                onApplyAssignments={(assignments, strategy) => {
                    setLocalSchedule(prev => {
                        const base = prev ?? { weekId, status: 'draft' as const, shifts: [] };

                        // Clear assignments of all shifts first before applying new ones as requested
                        const updatedShifts = base.shifts.map(s => {
                            const adds = assignments.filter(a => a.shiftId === s.id);

                            // Rebuild assignedUsers list from scratch for this shift (clearing old ones)
                            const newAssignedUsers = adds.map(a => {
                                const userRole = allUsers.find(u => u.uid === a.userId)?.role;
                                const resolvedRole: UserRole = (a.assignedRole && a.assignedRole !== 'Bất kỳ')
                                    ? a.assignedRole as UserRole
                                    : (userRole ?? 'Phục vụ');

                                return {
                                    userId: a.userId,
                                    userName: a.userName ?? (allUsers.find(u => u.uid === a.userId)?.displayName || a.userId),
                                    assignedRole: resolvedRole,
                                };
                            });

                            return { ...s, assignedUsers: newAssignedUsers };
                        });

                        const newSchedule = { ...base, shifts: updatedShifts };
                        setHasUnsavedChanges(!isEqual(newSchedule.shifts, serverSchedule?.shifts || []));
                        return newSchedule;
                    });
                    toast.success('Đã làm mới và áp dụng phân công từ trình xếp lịch. Hãy lưu hoặc công bố.');
                }}
                parentDialogTag='root'
            />
        </TooltipProvider>
    )
}
