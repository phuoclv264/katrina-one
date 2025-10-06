'use client';
import React from 'react';
import ScheduleView from './_components/schedule-view';

export default function SchedulePage() {
    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline">Lịch làm việc</h1>
                <p className="text-muted-foreground mt-2">
                   Xem lịch đã được phân công và đăng ký thời gian rảnh cho tuần tới.
                </p>
            </header>
            <ScheduleView />
        </div>
    );
}
