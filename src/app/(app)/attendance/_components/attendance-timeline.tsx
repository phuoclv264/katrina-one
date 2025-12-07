'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { format, startOfDay, addMinutes, differenceInMinutes, getISOWeek, getYear } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { AttendanceRecord, ManagedUser, Schedule, AssignedShift } from '@/lib/types';
import { getStatusInfo, findShiftForRecord } from '@/lib/attendance-utils';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { vi } from 'date-fns/locale';
import { Clock, Users } from 'lucide-react';
import Image from 'next/image';
import { ScrollAreaViewport } from '@radix-ui/react-scroll-area';

const SHIFT_BG_COLORS = [
    'bg-blue-100/50 dark:bg-blue-900/20', 'bg-cyan-100/50 dark:bg-cyan-900/20',
    'bg-yellow-100/50 dark:bg-yellow-900/20', 'bg-indigo-100/50 dark:bg-indigo-900/20',
    'bg-purple-100/50 dark:bg-purple-900/20', 'bg-pink-100/50 dark:bg-pink-900/20'
];

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

                    const isDuplicate = userGroup.some(otherUser => {
                        if (otherUser.uid === user.uid) return false;
                        const otherParts = otherUser.displayName.trim().split(/\s+/);
                        let otherAbbr = otherParts[otherParts.length - 1];
                        for (let j = otherParts.length - 2; j >= i; j--) { otherAbbr = `${otherParts[j].charAt(0).toUpperCase()}.${otherAbbr}`; }
                        return otherAbbr === candidateAbbr;
                    });
                    currentAbbr = candidateAbbr;
                    if (!isDuplicate) break;
                }
                abbreviations.set(user.uid, currentAbbr);
            });
        }
    }
    return abbreviations;
};

const TIMELINE_START_HOUR = 5;
const TIMELINE_END_HOUR = 24; // Represents 00:00 of the next day, timeline ends at 23:59:59
const TOTAL_HOURS_DISPLAYED = 19; // Total hours from 5:00 to 24:00
const TOTAL_TIMELINE_MINUTES = TOTAL_HOURS_DISPLAYED * 60;

const timeToPercentage = (time: Date) => {
    const timelineStartForDay = new Date(time);
    timelineStartForDay.setHours(TIMELINE_START_HOUR, 0, 0, 0);

    const minutesFromStart = differenceInMinutes(time, timelineStartForDay);
    const percentage = (minutesFromStart / TOTAL_TIMELINE_MINUTES) * 100;

    // Giới hạn trong khoảng 0–100%
    return Math.min(100, Math.max(0, percentage));
};

const getRoleBarColor = (role?: string): string => {
    switch (role) {
        case 'Phục vụ': return 'bg-blue-500/70 hover:bg-blue-500 border-blue-600/50';
        case 'Pha chế': return 'bg-green-500/70 hover:bg-green-500 border-green-600/50';
        case 'Thu ngân': return 'bg-orange-500/70 hover:bg-orange-500 border-orange-600/50';
        case 'Quản lý': return 'bg-purple-500/70 hover:bg-purple-500 border-purple-600/50';
        case 'Chủ nhà hàng': return 'bg-rose-500/70 hover:bg-rose-500 border-rose-600/50';
        default: return 'bg-gray-500/70 hover:bg-gray-500 border-gray-600/50';
    }
};

const AttendanceBar = ({ 
    record, 
    user, 
    nameInShort,
    currentTime,
    onOpenLightbox,
}: { 
    record: AttendanceRecord; 
    user: ManagedUser | undefined; 
    nameInShort: string | undefined;
    currentTime: Date;
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void; 
}) => {
    const isInProgress = record.status === 'in-progress' && !record.checkOutTime;
    if (!record.checkInTime) return null;
    if (!isInProgress && !record.checkOutTime) return null;

    const checkInTime = (record.checkInTime as Timestamp).toDate();
    const checkOutTime = isInProgress ? currentTime : (record.checkOutTime as Timestamp).toDate();

    const left = timeToPercentage(checkInTime);
    let width = timeToPercentage(checkOutTime) - left;

    if (width <= 0) return null;

    const shifts = findShiftForRecord(record, {}); // Note: Schedules are handled at the day level
    const statusInfo = getStatusInfo(record, shifts);

    const allRecordPhotos = [
        ...(record.photoInUrl ? [{
            src: record.photoInUrl,
            description: `Ảnh vào ca của ${user?.displayName} lúc ${format(checkInTime, 'HH:mm dd/MM/yy')}`
        }] : []),
        ...(record.breaks?.flatMap(b => [
            ...(b.breakStartPhotoUrl ? [{ src: b.breakStartPhotoUrl, description: `Ảnh bắt đầu nghỉ của ${user?.displayName} lúc ${format((b.breakStartTime as Timestamp).toDate(), 'HH:mm dd/MM/yy')}` }] : []),
            ...(b.breakEndPhotoUrl ? [{ src: b.breakEndPhotoUrl, description: `Ảnh kết thúc nghỉ của ${user?.displayName} lúc ${format((b.breakEndTime as Timestamp).toDate(), 'HH:mm dd/MM/yy')}` }] : [])
        ]) || []),
        ...(record.photoOutUrl ? [{
            src: record.photoOutUrl,
            description: `Ảnh ra ca của ${user?.displayName} lúc ${format(checkOutTime, 'HH:mm dd/MM/yy')}`
        }] : [])
    ];

    const openLightboxForRecord = (photoSrc: string) => {
        const photoIndex = allRecordPhotos.findIndex(p => p.src === photoSrc);
        onOpenLightbox(allRecordPhotos, photoIndex >= 0 ? photoIndex : 0);
    };

    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn("top-1/2 -translate-y-1/2 absolute h-6 rounded-md transition-all duration-200 cursor-pointer left-dynamic w-dynamic", getRoleBarColor(user?.role))}
                        style={{
                            '--dynamic-left': `${left}%`,
                            '--dynamic-width': `${width}%`,
                        } as React.CSSProperties}
                    >
                        <span className="flex items-center text-xs text-white font-medium px-1.5 py-0.5">
                            <span className="truncate">{nameInShort ?? user?.displayName} ({format(checkInTime, 'HH:mm')} - {isInProgress ? '' : format(checkOutTime, 'HH:mm')})</span>
                            {isInProgress && (
                                <Clock className="ml-1 h-3 w-3 flex-shrink-0 animate-pulse [animation-duration:3s]" />
                            )}
                        </span>
                    </div>
                </TooltipTrigger>
                <TooltipContent className="bg-card border-primary text-foreground">
                    <div className="p-2 text-sm space-y-1">
                        <p><strong>Nhân viên:</strong> {user?.displayName}</p>
                        {shifts.length > 0 && <p><strong>Ca làm:</strong> {shifts.map(s => `${s.label} (${s.timeSlot.start} - ${s.timeSlot.end})`).join(', ')}</p>}
                        {record.isOffShift && <p><strong>Ngoài giờ:</strong> {record.offShiftReason || 'Có'}</p>}
                        <p><strong>Giờ vào:</strong> {format(checkInTime, 'HH:mm')}</p> 
                        <p><strong>Giờ ra:</strong> {isInProgress ? 'Đang làm việc...' : format(checkOutTime, 'HH:mm')}</p>
                        {record.breaks && record.breaks.length > 0 && (
                            <div className="text-sm">
                                <p><strong>Nghỉ giải lao:</strong></p>
                                {record.breaks.map((breakItem, index) => (
                                    <p key={index} className="pl-2 text-xs">
                                        - Lần {index + 1}: {format((breakItem.breakStartTime as Timestamp).toDate(), 'HH:mm')} - {breakItem.breakEndTime ? format((breakItem.breakEndTime as Timestamp).toDate(), 'HH:mm') : '...'}
                                    </p>
                                ))}
                            </div>
                        )}
                        <p><strong>Tổng giờ:</strong> {record.totalHours?.toFixed(2) || 'N/A'} giờ</p>
                        <p><strong>Lương:</strong> {record.salary?.toLocaleString('vi-VN')}đ ({record.hourlyRate?.toLocaleString('vi-VN')}đ/giờ)</p>
                        <div className={cn("flex items-center gap-1", statusInfo.color)}>
                            {statusInfo.icon} {statusInfo.text}
                        </div>
                        {record.lateReason && (
                            <div className="text-xs text-destructive italic border-t pt-1 mt-1">
                                <p>Xin trễ {record.estimatedLateMinutes} phút: {record.lateReason}</p>
                            </div>
                        )}
                        <div className="flex gap-2 pt-2 border-t mt-2">
                            {record.photoInUrl && <button onClick={() => openLightboxForRecord(record.photoInUrl!)} className="relative h-10 w-10 rounded-md overflow-hidden"><Image src={record.photoInUrl} alt="Check-in" layout="fill" objectFit="cover" /></button>}
                            {record.breaks?.map((breakItem, breakIndex) => (
                                <React.Fragment key={`break-thumb-${breakIndex}`}>
                                    {breakItem.breakStartPhotoUrl && (
                                        <button onClick={() => openLightboxForRecord(breakItem.breakStartPhotoUrl!)} className="relative h-10 w-10 rounded-md overflow-hidden border-2 border-blue-400">
                                            <Image src={breakItem.breakStartPhotoUrl} alt={`Break start ${breakIndex + 1}`} layout="fill" objectFit="cover" />
                                        </button>
                                    )}
                                    {breakItem.breakEndPhotoUrl && (
                                        <button onClick={() => openLightboxForRecord(breakItem.breakEndPhotoUrl!)} className="relative h-10 w-10 rounded-md overflow-hidden border-2 border-green-400">
                                            <Image src={breakItem.breakEndPhotoUrl} alt={`Break end ${breakIndex + 1}`} layout="fill" objectFit="cover" />
                                        </button>
                                    )}
                                </React.Fragment>
                            ))}
                            {record.photoOutUrl && <button onClick={() => openLightboxForRecord(record.photoOutUrl!)} className="relative h-10 w-10 rounded-md overflow-hidden"><Image src={record.photoOutUrl} alt="Check-out" layout="fill" objectFit="cover" /></button>}
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const roleOrder: Record<string, number> = {
    'Phục vụ': 1,
    'Pha chế': 2,
    'Thu ngân': 3,
    'Quản lý': 4,
    'Chủ nhà hàng': 5,
};

export default function AttendanceTimeline({
    records,
    users,
    schedules,
    dateRange,
    filteredUserIds,
    onOpenLightbox,
}: {
    records: AttendanceRecord[];
    users: ManagedUser[];
    schedules: Record<string, Schedule>;
    dateRange?: { from: Date; to: Date };
    filteredUserIds: Set<string>;
    onOpenLightbox: (slides: { src: string, description?: string }[], index: number) => void;
}) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Update the current time every minute to make in-progress bars grow
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const userAbbreviations = useMemo(() => generateSmartAbbreviations(users), [users]);
    const shiftDefinitions = useMemo(() => {
        const uniqueShifts = new Map<string, { templateId: string; start: string; end: string }>();
        Object.values(schedules).forEach(schedule => {
            schedule.shifts.forEach(shift => {
                // Use templateId as the key to ensure uniqueness for each defined shift template
                if (!uniqueShifts.has(shift.templateId)) {
                    uniqueShifts.set(shift.templateId, { templateId: shift.templateId, ...shift.timeSlot });
                }
            });
        });

        return Array.from(uniqueShifts.values()).map((shiftInfo, index) => ({
            ...shiftInfo,
            color: SHIFT_BG_COLORS[index % SHIFT_BG_COLORS.length]
        }));

    }, [schedules]);

    const timeLabels = Array.from({ length: (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 2 + 1 }, (_, i) => {
        const hour = TIMELINE_START_HOUR + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    });

    const recordsByDay = useMemo(() => {
        const grouped: { [key: string]: AttendanceRecord[] } = {};
        records.forEach(record => {
            const day = format((record.checkInTime as Timestamp).toDate(), 'yyyy-MM-dd');
            if (!grouped[day]) {
                grouped[day] = [];
            }
            grouped[day].push(record);
        });
        return grouped;
    }, [records]);

    const sortedDays = Object.keys(recordsByDay).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (records.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground">
                Không có dữ liệu chấm công cho khoảng thời gian đã chọn.
            </div>
        );
    }

    return (
        <Card className="w-full max-w-screen-xl mx-auto">
            <CardContent className="p-0">
                <div className="flex w-full">
                    {/* Sticky Date Column Header */}
                    <div className="left-0 w-48 shrink-0 border-r bg-card">
                        <div className="flex h-14 items-center justify-center border-b p-2 text-center font-semibold">
                            Ngày
                        </div>
                    </div>

                    {/* Timeline Area */}
                    <div className="w-full">
                        {/* Timeline Header */}
                        <div className="top-0 flex h-14 items-center border-b bg-card">
                            {Array.from({ length: TOTAL_HOURS_DISPLAYED }, (_, i) => i + 5).map((hour) => (
                                <div key={hour} className="relative flex-1 shrink-0 text-center text-xs text-muted-foreground min-w-[20px]">
                                    <span className="absolute -left-px top-0 h-full border-l border-dashed" />
                                    <span className="inline-block pt-1">{hour.toString().padStart(2, '0')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="w-full">
                    {sortedDays.map((day) => {
                        const dayDate = new Date(day);
                        const weekId = `${getYear(dayDate)}-W${getISOWeek(dayDate)}`;
                        const scheduleForDay = schedules[weekId];
                        const shiftsForDay = scheduleForDay?.shifts.filter((s) => s.date === day) || [];

                        return (
                            <div key={day} className="flex border-b">
                                <div className="left-0 w-48 shrink-0 border-r bg-card py-2 px-3">
                                    <div className="text-center mb-2">
                                        <p className="font-bold text-lg">{format(new Date(day), 'dd')}</p>
                                        <p className="text-xs text-muted-foreground">{format(new Date(day), 'E', { locale: vi })}</p>
                                    </div>
                                    <div className="text-xs text-muted-foreground p-2 rounded-md bg-muted/50 border">
                                        {shiftsForDay.length > 0 ? (
                                            shiftsForDay.map(shift => {
                                                const userNames = shift.assignedUsers.map(u => userAbbreviations.get(u.userId) || u.userName).join(', ');
                                                return (
                                                    <p key={shift.id} className="whitespace-normal"><span className="font-semibold text-foreground">{shift.label}:</span> {userNames}.</p>
                                                );
                                            })
                                        ) : (
                                            <p className="italic">Không có lịch làm.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="relative h-full min-h-[4rem] flex-1 py-2">
                                    {/* Shift Backgrounds */}
                                    {shiftDefinitions.map(shift => {
                                        const dayStart = new Date(day);
                                        const [startH, startM] = shift.start.split(':').map(Number);
                                        const [endH, endM] = shift.end.split(':').map(Number);
                                        const shiftStart = new Date(dayStart.setHours(startH, startM));
                                        const shiftEnd = new Date(dayStart.setHours(endH, endM));
                                        const left = timeToPercentage(shiftStart);
                                        const width = timeToPercentage(shiftEnd) - left;
                                        return (
                                            <div key={shift.templateId} className={cn("absolute top-0 bottom-0 -z-10 left-dynamic w-dynamic", shift.color)} style={{ '--dynamic-left': `${left}%`, '--dynamic-width': `${width}%` } as React.CSSProperties} />
                                        );
                                    })}
                                    {/* Attendance Bars */}
                                    <div className="relative space-y-1">
                                        {Object.entries(
                                            recordsByDay[day].reduce((acc, record) => {
                                                if (filteredUserIds.size === 0 || filteredUserIds.has(record.userId)) {
                                                    if (!acc[record.userId]) acc[record.userId] = [];
                                                    acc[record.userId].push(record);
                                                }
                                                return acc;
                                            }, {} as Record<string, AttendanceRecord[]>)
                                        )
                                            .sort(([userIdA], [userIdB]) => {
                                                const userA = users.find(u => u.uid === userIdA);
                                                const userB = users.find(u => u.uid === userIdB);
                                                const roleAOrder = userA?.role ? roleOrder[userA.role] || 99 : 99;
                                                const roleBOrder = userB?.role ? roleOrder[userB.role] || 99 : 99;
                                                return roleAOrder - roleBOrder;
                                            })
                                            .map(([userId, userRecords]) => {
                                                const userShifts = shiftsForDay.filter(s => s.assignedUsers.some(u => u.userId === userId));
                                                return (
                                                    <div key={userId} className="relative h-7">
                                                        {/* Assigned Shift Markers */}
                                                        {userShifts.map(shift => {
                                                            const dayStart = new Date(day);
                                                            const [startH, startM] = shift.timeSlot.start.split(':').map(Number);
                                                            const [endH, endM] = shift.timeSlot.end.split(':').map(Number);
                                                            const shiftStart = new Date(new Date(dayStart).setHours(startH, startM, 0, 0));
                                                            const shiftEnd = new Date(new Date(dayStart).setHours(endH, endM, 0, 0));

                                                            const startPercentage = timeToPercentage(shiftStart);
                                                            const widthPercentage = timeToPercentage(shiftEnd) - startPercentage;

                                                            const userDetails = users.find(u => u.uid === userId);

                                                            return (
                                                                <TooltipProvider key={shift.id} delayDuration={100}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div
                                                                                className="absolute top-1/2 -translate-y-1/2 h-1 bg-orange-200 dark:bg-gray-700/50 rounded-sm left-dynamic w-dynamic"
                                                                                style={{ '--dynamic-left': `${startPercentage}%`, '--dynamic-width': `${widthPercentage}%` } as React.CSSProperties}
                                                                            />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p><strong>{userDetails?.displayName}</strong></p>
                                                                            <p>Ca: {shift.label} ({shift.timeSlot.start} - {shift.timeSlot.end})</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            );
                                                        })} 
                                                        {userRecords.map(record => <AttendanceBar key={record.id} record={record} user={users.find(u => u.uid === userId)} nameInShort={userAbbreviations.get(userId)} currentTime={currentTime} onOpenLightbox={onOpenLightbox} />)}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}