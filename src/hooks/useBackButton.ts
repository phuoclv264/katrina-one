"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import toast from "react-hot-toast";

interface LightboxControls {
  isLightboxOpen: boolean;
  closeLightbox: () => void;
}

interface DialogControls {
  isAnyDialogOpen: boolean;
  closeDialog: () => void;
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
          return;
        }

        // CLOSE MODALS/DIALOGS/POPOVERS
        if (dialog?.isAnyDialogOpen) {
          dialog.closeDialog();
          return;
        }

        // 2. IF CAPACITOR'S WEBVIEW CAN GO BACK, LET NEXT.JS ROUTER HANDLE IT
        // The `canGoBack` property from the event correctly reflects the browser's history stack.
        if (canGoBack) {
          router.back();
          return;
        }

        // 3. IF AT THE ROOT OF THE APP, MINIMIZE IT
        // This prevents the app from closing when the user is on the main screen.
        if (pathname === "/shifts" || pathname === "/bartender" || pathname === "/manager" || pathname === "/admin") {
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
}
