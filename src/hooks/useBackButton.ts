"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import usePreserveScroll from '@/hooks/use-preserve-scroll';

interface LightboxControls {
  isLightboxOpen: boolean;
  closeLightbox: () => void;
}

interface DialogControls {
  isAnyDialogOpen: boolean;
  closeDialog: () => void;
  openDialogCount?: number;
}

export function useBackButton(
  dialog?: DialogControls,
  lightbox?: LightboxControls,
  userRole?: string
) {
  const nav = useAppNavigation();
  const pathname = usePathname();

  // Use refs to hold the latest values of dependencies
  const lightboxRef = useRef(lightbox);
  const dialogRef = useRef(dialog);
  useEffect(() => {
    lightboxRef.current = lightbox;
    dialogRef.current = dialog;
  }, [lightbox, dialog]);

  const backButtonHandler = useCallback(
    ({ canGoBack }: { canGoBack: boolean }) => {
      const currentLightbox = lightboxRef.current;
      const currentDialog = dialogRef.current;
      if (currentLightbox?.isLightboxOpen) {
        currentLightbox.closeLightbox();
      } else if (currentDialog?.isAnyDialogOpen) {
        currentDialog.closeDialog();
      } else {
        // Prefer navigating back in the app/navigation history when possible.
        // `canGoBack` represents the webview history state; if it's true we
        // perform a back navigation. Otherwise fall back to sending the user
        // to their role-specific home page.
         try {
            nav.back();
          } catch {
            // If nav.back throws for any reason, fall through to role fallback
            App.minimizeApp();
          }
      }
    },
    [nav, userRole, pathname]
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handler: PluginListenerHandle;
    App.addListener("backButton", backButtonHandler).then(
      (h) => (handler = h)
    );

    return () => {
      handler?.remove();
    };
  }, [backButtonHandler]);

  const { restore, persist } = usePreserveScroll();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // --- OPEN LIGHTBOX ---
    if (lightbox?.isLightboxOpen && !history.state?.lightbox) {
      try { persist(); } catch {}
      window.history.pushState({ lightbox: true }, "", window.location.href);
    }
  }, [lightbox?.isLightboxOpen, persist]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // --- OPEN DIALOG ---
    // Push a history state every time the dialog open count changes so nested
    // dialogs create additional history entries. We store the count to avoid
    // pushing duplicate entries for the same count value.
    if (dialog && typeof dialog.openDialogCount === 'number' && dialog.openDialogCount > 0) {
      const currentCount = history.state?.dialogCount;
      if (currentCount !== dialog.openDialogCount) {
        try { persist(); } catch {}
        window.history.pushState({ dialog: true, dialogCount: dialog.openDialogCount }, "", window.location.href);
      }
    }

    // --- BACK BUTTON HANDLER ---
    const handlePopState = () => {
      // CLOSE LIGHTBOX FIRST
      if (lightbox?.isLightboxOpen) {
        lightbox.closeLightbox();
        try { restore(); } catch {}
        return; // prevent navigation
      }

      // CLOSE DIALOG (close top-most)
      if (dialog?.isAnyDialogOpen) {
        dialog.closeDialog();
        try { restore(); } catch {}
        return; // prevent navigation
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // We include openDialogCount in the dependency list so this runs whenever
    // a new dialog is registered/unregistered (including nested dialogs).
  }, [dialog?.openDialogCount, lightbox?.isLightboxOpen]);
}
