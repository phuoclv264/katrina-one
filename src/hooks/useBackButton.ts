"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";

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
  lightbox?: LightboxControls
) {
  const router = useRouter();
  const pathname = usePathname();
  const handler = useRef<PluginListenerHandle | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const addListener = async () => {
      handler.current = await App.addListener("backButton", ({ canGoBack }) => {
        if (lightbox?.isLightboxOpen) {
          lightbox.closeLightbox();
        } else if (dialog?.isAnyDialogOpen) {
          dialog.closeDialog();
        } else if (canGoBack) {
          router.back();
          // } else if (pathname === "/shifts" || pathname === "/bartender" || pathname === "/manager" || pathname === "/admin" || pathname === "/cashier") {
          //   App.minimizeApp(); // This minimizes the app, it does not exit it.
        } else {
          App.minimizeApp(); // This minimizes the app, it does not exit it.
        }
      });
    };

    addListener();

    return () => {
      if (handler.current) {
        handler.current.remove();
        handler.current = null;
      }
    };
  }, [router, pathname, lightbox, dialog]);

  useEffect(() => {
    // --- OPEN LIGHTBOX ---
    if (lightbox?.isLightboxOpen && !history.state?.lightbox) {
      window.history.pushState({ lightbox: true }, "", window.location.href);
    }
  }, [lightbox?.isLightboxOpen]);

  useEffect(() => {
    // --- OPEN DIALOG ---
    // Push a history state every time the dialog open count changes so nested
    // dialogs create additional history entries. We store the count to avoid
    // pushing duplicate entries for the same count value.
    if (dialog && typeof dialog.openDialogCount === 'number' && dialog.openDialogCount > 0) {
      const currentCount = history.state?.dialogCount;
      if (currentCount !== dialog.openDialogCount) {
        window.history.pushState({ dialog: true, dialogCount: dialog.openDialogCount }, "", window.location.href);
      }
    }

    // --- BACK BUTTON HANDLER ---
    const handlePopState = () => {
      // CLOSE LIGHTBOX FIRST
      if (lightbox?.isLightboxOpen) {
        lightbox.closeLightbox();
        return; // prevent navigation
      }

      // CLOSE DIALOG (close top-most)
      if (dialog?.isAnyDialogOpen) {
        dialog.closeDialog();
        return; // prevent navigation
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // We include openDialogCount in the dependency list so this runs whenever
    // a new dialog is registered/unregistered (including nested dialogs).
  }, [dialog?.openDialogCount, lightbox?.isLightboxOpen]);
}
