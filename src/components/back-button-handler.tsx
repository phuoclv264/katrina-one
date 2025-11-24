'use client';

import { useBackButton } from '@/hooks/useBackButton';
import { useLightbox } from '@/contexts/lightbox-context';
import { useDialogContext } from '@/contexts/dialog-context';
import { useAuth } from '@/hooks/use-auth';

export function BackButtonHandler() {
  const { isLightboxOpen, closeLightbox } = useLightbox();
  const { isAnyDialogOpen, closeDialog } = useDialogContext();
  const {user} = useAuth();

  useBackButton(
    {
      isAnyDialogOpen,
      closeDialog,
    },
    {
      isLightboxOpen,
      closeLightbox,
    },
    user?.role
  );
  return null; // This component does not render anything
}