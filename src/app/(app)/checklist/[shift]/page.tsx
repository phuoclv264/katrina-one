import WorkShiftGuard from '@/components/work-shift-guard';
import ChecklistPageComponent from './checklist-page-client';

export async function generateStaticParams() {
  return [
    { shift: 'sang' },
    { shift: 'trua' },
    { shift: 'toi' },
  ];
}

export default function Page() {
  return (
    <WorkShiftGuard redirectPath="/shifts">
      <ChecklistPageComponent />
    </WorkShiftGuard>
  )
}
