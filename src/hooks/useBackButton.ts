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
    if (dialog?.isAnyDialogOpen && !history.state?.dialog) {
      window.history.pushState({ dialog: true }, "", window.location.href);
    }

    // --- BACK BUTTON HANDLER ---
    const handlePopState = () => {
      // CLOSE LIGHTBOX FIRST
      if (lightbox?.isLightboxOpen) {
        lightbox.closeLightbox();
        return; // prevent navigation
      }

      // CLOSE DIALOG
      if (dialog?.isAnyDialogOpen) {
        dialog.closeDialog();
        return; // prevent navigation
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dialog?.isAnyDialogOpen, lightbox?.isLightboxOpen]);
}
