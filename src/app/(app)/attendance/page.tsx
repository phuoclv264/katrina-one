import React, { Suspense } from 'react';
import AttendancePageComponent from './_components/attendance-page-client';

export default function AttendancePage() {
    return (
        <Suspense fallback={<div>Đang tải...</div>}>
            <AttendancePageComponent />
        </Suspense>
    );
}
