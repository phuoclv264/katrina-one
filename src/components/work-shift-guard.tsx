
'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { getHomePathForRole } from '@/lib/navigation';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';

type WorkShiftGuardProps = {
  children: React.ReactNode;
  redirectPath: string;
};

export default function WorkShiftGuard({ children, redirectPath }: WorkShiftGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const nav = useAppNavigation();
  const { isCheckedIn } = useCheckInCardPlacement();
  const [isReady, setIsReady] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // We need to wait for both auth state and check-in status to be resolved.
  useEffect(() => {
    // Set a timeout to redirect if auth or check-in status is not resolved in 10 seconds.
    timeoutRef.current = setTimeout(() => {
      if (!isReady) {
        console.warn('WorkShiftGuard: Timed out waiting for auth/check-in status. Redirecting.');
        nav.replace(getHomePathForRole(user?.role));
      }
    }, 10000);

    if (!authLoading) {
      // Once isCheckedIn is determined (either true or false), we are ready.
      if (isCheckedIn !== undefined) {
        setIsReady(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    }

    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [authLoading, isCheckedIn, nav, user?.role]);

  if (!isReady) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang kiểm tra ca làm việc...</p>
        </div>
      </div>
    );
  }

  if (!isCheckedIn) {
    return (
      <AlertDialog open={true} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chưa chấm công</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn cần phải chấm công để truy cập chức năng này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => nav.replace(getHomePathForRole(user?.role))}>Đã hiểu</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return <>{children}</>;
}
