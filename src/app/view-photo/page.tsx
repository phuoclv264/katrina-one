'use client';
import { Suspense } from 'react';
import PhotoViewer from './_components/photo-viewer';
import { Skeleton } from '@/components/ui/skeleton';

function PhotoViewerSkeleton() {
    return (
        <div className="w-screen h-screen bg-black flex items-center justify-center">
            <Skeleton className="w-[90vw] h-[90vh] bg-neutral-800" />
        </div>
    )
}

export default function ViewPhotoPage() {
  return (
    <Suspense fallback={<PhotoViewerSkeleton />}>
        <PhotoViewer />
    </Suspense>
  );
}
