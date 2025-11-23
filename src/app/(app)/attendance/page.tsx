import React, { Suspense } from 'react';
import AttendancePageComponent from './_components/attendance-page-client';
import { LoadingPage } from '@/components/loading/LoadingPage';

export default function AttendancePage() {
    return (
        <Suspense fallback={<LoadingPage />}>
            <AttendancePageComponent />
        </Suspense>
    );
}
