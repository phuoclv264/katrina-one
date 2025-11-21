'use client';

import { useBackButton } from '@/hooks/useBackButton';
import { useLightbox } from '@/contexts/lightbox-context';

export function BackButtonHandler() {
  const { isLightboxOpen, closeLightbox } = useLightbox();
  useBackButton({
    isLightboxOpen,
    closeLightbox,
  });
  return null; // This component does not render anything
}