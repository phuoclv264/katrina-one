'use client';

import { useBackButton } from '@/hooks/useBackButton';
import { useLightbox } from '@/contexts/lightbox-context';
import { useDialogContext } from '@/contexts/dialog-context';

export function BackButtonHandler() {
  const { isLightboxOpen, closeLightbox } = useLightbox();
  const { isAnyDialogOpen, closeDialog, openDialogCount } = useDialogContext();

  useBackButton(
    {
      isAnyDialogOpen,
      closeDialog,
      openDialogCount,
    },
    {
      isLightboxOpen,
      closeLightbox,
    }
  );
  return null; // This component does not render anything
}