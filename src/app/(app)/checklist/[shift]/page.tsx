import { Suspense } from 'react';
import WorkShiftGuard from '@/components/work-shift-guard';
import ChecklistPageComponent from './checklist-page-client';
import { LoadingPage } from '@/components/loading/LoadingPage';

export async function generateStaticParams() {
  return [
    { shift: 'sang' },
    { shift: 'trua' },
    { shift: 'toi' },
  ];
}

export default async function Page(props: { params: Promise<{ shift: string }> }) {
  const params = await props.params;
  return (
    <WorkShiftGuard redirectPath="/shifts">
      <Suspense fallback={<LoadingPage />}>
        <ChecklistPageComponent shift={params.shift} />
      </Suspense>
    </WorkShiftGuard>
  )
}
