'use client';

import WorkShiftGuard from '@/components/work-shift-guard';
import ManagerReportView from './_components/manager-report-view';

export default function ComprehensiveReportPage() {
    return (
        <WorkShiftGuard redirectPath="/manager">
            <ManagerReportView isStandalone={true} />
        </WorkShiftGuard>
    )
}
