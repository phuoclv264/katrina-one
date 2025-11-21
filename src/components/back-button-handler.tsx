'use client';

import { useBackButton } from '@/hooks/useBackButton';
import { useLightbox } from '@/contexts/lightbox-context';
import { useDialogContext } from '@/contexts/dialog-context';

export function BackButtonHandler() {
  const { isLightboxOpen, closeLightbox } = useLightbox();
  // Get the new closeAllDialogs function from the context
  const { isAnyDialogOpen, closeAllDialogs } = useDialogContext();

  useBackButton({
    isAnyDialogOpen,
    // Pass the direct closeAllDialogs function to the useBackButton hook
    closeDialog: closeAllDialogs,
  }, { isLightboxOpen, closeLightbox });
  return null; // This component does not render anything
}