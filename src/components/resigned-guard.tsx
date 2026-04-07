'use client';

import { useAuth } from '@/hooks/use-auth';

export function ResignedGuard() {
  const { renderResignedDialog } = useAuth();
  return <>{renderResignedDialog()}</>;
}
